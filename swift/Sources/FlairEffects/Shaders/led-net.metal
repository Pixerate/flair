// flair-metal-hash: 5fede81f
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    packed_float3 uTint;
    float uImageColour;
    float uRainbow;
    float uPitch;
    float uLightSize;
    float uFlare;
    float uDrape;
    float uThreshold;
    float uBacklight;
    float uTwinkle;
    float uSpeed;
    char _m24_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_led_net_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _336 = ts.x <= 1;
    bool _343;
    if (!_336)
    {
        _343 = ts.y <= 1;
    }
    else
    {
        _343 = _336;
    }
    bool _350;
    if (!_343)
    {
        _350 = _192.iResolution[0u] <= 0.0;
    }
    else
    {
        _350 = _343;
    }
    bool _357;
    if (!_350)
    {
        _357 = _192.iResolution[1u] <= 0.0;
    }
    else
    {
        _357 = _350;
    }
    if (_357)
    {
        return uv;
    }
    float boxAspect = _192.iResolution[0u] / _192.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _380;
    if (boxAspect > texAspect)
    {
        _380 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _380 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _380;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _192)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_192.uBackdrop) * _192.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_192.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    float4 _407;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _407 = overBackdrop(param, _192);
    }
    else
    {
        float2 param_1 = fract(uv);
        _407 = float4(testCard(param_1), 1.0);
    }
    return _407;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _192);
    return pictureRGBA(tex, texSmplr, param_1, _192);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _192)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _192).xyz;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float vnoise(thread const float2& p)
{
    float2 i = floor(p);
    float2 f = fract(p);
    float2 u = (f * f) * (float2(3.0) - (f * 2.0));
    float2 param = i;
    float a = hash12(param);
    float2 param_1 = i + float2(1.0, 0.0);
    float b = hash12(param_1);
    float2 param_2 = i + float2(0.0, 1.0);
    float c = hash12(param_2);
    float2 param_3 = i + float2(1.0);
    float d = hash12(param_3);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _192, texture2d<float> uImage, sampler uImageSmplr)
{
    float t = _192.iTime * _192.uSpeed;
    float2 uv0 = fragCoord / float2(_192.iResolution[0], _192.iResolution[1]);
    float y = fragCoord.y / _192.iResolution[1u];
    float k = 9.0 / _192.iResolution[1u];
    float phase = ((fragCoord.x * k) + (1.2000000476837158203125 * sin((y * 2.2999999523162841796875) + (t * 1.2999999523162841796875)))) + (0.60000002384185791015625 * sin((y * 5.099999904632568359375) - t));
    float amp = (_192.uDrape * 0.85000002384185791015625) / k;
    float2 q = fragCoord + float2(amp * sin(phase), ((_192.uPitch * 0.800000011920928955078125) * _192.uDrape) * sin((((fragCoord.x * k) * 0.60000002384185791015625) + (y * 1.7000000476837158203125)) + t));
    float facing = 1.0 + ((_192.uDrape * 0.85000002384185791015625) * cos(phase));
    float shade = fast::clamp(0.25 + (0.75 * facing), 0.1500000059604644775390625, 1.60000002384185791015625);
    float2 g = q / float2(_192.uPitch);
    float2 cell = floor(g);
    float r = ((_192.uLightSize * _192.uPitch) * 0.07999999821186065673828125) + 0.60000002384185791015625;
    float len = (_192.uFlare * _192.uPitch) * 0.4000000059604644775390625;
    float3 light = float3(0.0);
    for (int j = -1; j <= 1; j++)
    {
        for (int i = -1; i <= 1; i++)
        {
            float2 c = cell + float2(float(i), float(j));
            float2 param = c;
            float2 centre = (c + float2(0.5)) + ((hash22(param) - float2(0.5)) * 0.07999999821186065673828125);
            float2 dq = (g - centre) * _192.uPitch;
            float2 d = float2(dq.x / fast::max(facing, 0.1500000059604644775390625), dq.y);
            float2 param_1 = (fragCoord - d) / float2(_192.iResolution[0], _192.iResolution[1]);
            float3 pic = pictureCover(uImage, uImageSmplr, param_1, _192);
            float lum = dot(pic, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
            float on = smoothstep(_192.uThreshold, _192.uThreshold + 0.20000000298023223876953125, lum) * (0.3499999940395355224609375 + (0.89999997615814208984375 * lum));
            if (on < 0.00999999977648258209228515625)
            {
                continue;
            }
            float2 param_2 = c + float2(4.099999904632568359375);
            float tw = 1.0 - ((_192.uTwinkle * 0.60000002384185791015625) * (0.5 + (0.5 * sin((t * 9.0) + (hash12(param_2) * 40.0)))));
            float3 col = mix(float3(_192.uTint) * (0.699999988079071044921875 + (0.60000002384185791015625 * lum)), pic * 1.39999997615814208984375, float3(_192.uImageColour));
            float2 param_3 = (c * 0.10999999940395355224609375) + float2(t * 0.60000002384185791015625, (-t) * 0.300000011920928955078125);
            float rainbow = smoothstep(0.579999983310699462890625, 0.7799999713897705078125, vnoise(param_3)) * _192.uRainbow;
            float2 param_4 = c + float2(7.69999980926513671875);
            float3 hue = float3(0.5) + (cos((float3(hash12(param_4)) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
            col = mix(col, hue * 1.2000000476837158203125, float3(rainbow));
            float energy = (on * tw) * shade;
            float dd = dot(d, d);
            float core = exp((-dd) / (r * r));
            float halo = exp((-dd) / ((r * r) * 6.0)) * 0.300000011920928955078125;
            float2 a = float2(d.x + d.y, d.y - d.x) * 0.707099974155426025390625;
            float star = 0.0;
            if (len > 0.0)
            {
                star = (exp((-abs(a.y)) / 0.699999988079071044921875) * exp((-abs(a.x)) / len)) + (exp((-abs(a.x)) / 0.699999988079071044921875) * exp((-abs(a.y)) / len));
            }
            light += (((col * (((1.7999999523162841796875 * core) + halo) + (0.699999988079071044921875 * star))) + (float3(1.10000002384185791015625) * exp((-dd) / ((r * r) * 0.20000000298023223876953125)))) * energy);
        }
    }
    float2 param_5 = uv0;
    float4 back = pictureCoverRGBA(uImage, uImageSmplr, param_5, _192);
    float3 col_1 = ((back.xyz * _192.uBacklight) * mix(float3(1.0), float3(_192.uTint) * 1.5, float3(0.75))) + (light * (1.0 - (0.20000000298023223876953125 * exp(-length(light)))));
    float peak = fast::max(col_1.x, fast::max(col_1.y, col_1.z));
    col_1 *= ((1.0 - exp((-peak) * 2.2000000476837158203125)) / fast::max(peak, 9.9999997473787516355514526367188e-05));
    fragColor = float4(col_1, fast::max(back.w, fast::clamp(length(light), 0.0, 1.0)));
}

fragment flair_led_net_frag_out flair_led_net_frag(constant FlairUniforms& _192 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_led_net_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _919;
    if (_192.flair_flipY > 0.5)
    {
        _919 = _192.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _919 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _919);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _192, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

