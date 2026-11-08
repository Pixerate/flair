// flair-metal-hash: e9959b49
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
    uint uAnimate;
    float uProgress;
    float3 uDark;
    packed_float3 uRim;
    float uTendrils;
    uint uEyes;
    char _m19_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_transition_shadow_swallow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float progress(constant FlairUniforms& _216)
{
    float _458;
    if (_216.uAnimate != 0u)
    {
        _458 = smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, 0.5 - (0.5 * cos((_216.iTime * 6.28318023681640625) / 4.0)));
    }
    else
    {
        _458 = _216.uProgress;
    }
    return _458;
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
float fbm(thread float2& p, thread const int& octaves)
{
    float sum = 0.0;
    float amp = 0.5;
    float2x2 turn = float2x2(float2(0.800000011920928955078125, 0.60000002384185791015625), float2(-0.60000002384185791015625, 0.800000011920928955078125));
    for (int i = 0; i < 8; i++)
    {
        if (i >= octaves)
        {
            break;
        }
        float2 param = p;
        sum += (amp * vnoise(param));
        p = ((turn * p) * 2.019999980926513671875) + float2(17.0);
        amp *= 0.5;
    }
    return sum;
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _355 = ts.x <= 1;
    bool _362;
    if (!_355)
    {
        _362 = ts.y <= 1;
    }
    else
    {
        _362 = _355;
    }
    bool _369;
    if (!_362)
    {
        _369 = _216.iResolution[0u] <= 0.0;
    }
    else
    {
        _369 = _362;
    }
    bool _376;
    if (!_369)
    {
        _376 = _216.iResolution[1u] <= 0.0;
    }
    else
    {
        _376 = _369;
    }
    if (_376)
    {
        return uv;
    }
    float boxAspect = _216.iResolution[0u] / _216.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _399;
    if (boxAspect > texAspect)
    {
        _399 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _399 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _399;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _216)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_216.uBackdrop) * _216.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_216.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    float4 _426;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _426 = overBackdrop(param, _216);
    }
    else
    {
        float2 param_1 = fract(uv);
        _426 = float4(testCard(param_1), 1.0);
    }
    return _426;
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _216)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _216);
    return pictureRGBA(tex, texSmplr, param_1, _216);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _216, texture2d<float> uFrom, sampler uFromSmplr, texture2d<float> uTo, sampler uToSmplr)
{
    float2 uv = fragCoord / float2(_216.iResolution[0], _216.iResolution[1]);
    float aspect = _216.iResolution[0u] / _216.iResolution[1u];
    float k = progress(_216);
    float2 p = (fragCoord - (float2(_216.iResolution[0], _216.iResolution[1]) * 0.5)) / float2(_216.iResolution[1u]);
    float2 e = p / float2(0.5 * aspect, 0.5);
    float r = mix(fast::max(abs(e.x), abs(e.y)), length(e), 0.60000002384185791015625);
    float ang = precise::atan2(e.y, e.x);
    float2 param = float2((ang * 2.5) + (k * 2.0), (r * 3.0) - (k * 3.0));
    int param_1 = 5;
    float _544 = fbm(param, param_1);
    float t = _544;
    float2 param_2 = float2(ang * 9.0, k * 2.0);
    float fingers = powr(vnoise(param_2), 3.0);
    float edge = (r + (((t - 0.5) * 0.3499999940395355224609375) * _216.uTendrils)) + ((fingers * 0.25) * _216.uTendrils);
    float _575;
    if (k < 0.5)
    {
        _575 = mix(2.0, -0.4000000059604644775390625, smoothstep(0.0, 0.5, k));
    }
    else
    {
        _575 = mix(-0.4000000059604644775390625, 2.0, smoothstep(0.5, 1.0, k));
    }
    float front = _575;
    float dark = smoothstep(front - 0.0599999986588954925537109375, front + 0.0199999995529651641845703125, edge);
    float rim = exp((-abs((edge - front) + 0.02999999932944774627685546875)) / 0.02999999932944774627685546875) * (1.0 - dark);
    float4 _611;
    if (k < 0.5)
    {
        float2 param_3 = uv;
        _611 = pictureCoverRGBA(uFrom, uFromSmplr, param_3, _216);
    }
    else
    {
        float2 param_4 = uv;
        _611 = pictureCoverRGBA(uTo, uToSmplr, param_4, _216);
    }
    float4 pic = _611;
    float3 col = mix(pic.xyz, float3(_216.uRim), float3(rim * 0.60000002384185791015625));
    col = mix(col, _216.uDark, float3(dark));
    if (_216.uEyes != 0u)
    {
        float open = smoothstep(0.4199999868869781494140625, 0.4699999988079071044921875, k) * (1.0 - smoothstep(0.5299999713897705078125, 0.579999983310699462890625, k));
        float2 q = p - float2(0.0599999986588954925537109375, 0.039999999105930328369140625);
        q.x = abs(q.x) - 0.04500000178813934326171875;
        float eye = 1.0 - smoothstep(0.008000000379979610443115234375, 0.01200000010430812835693359375, length(q / float2(1.0, fast::max(open, 0.0500000007450580596923828125) * 0.449999988079071044921875)));
        col = mix(col, float3(1.0, 0.819999992847442626953125, 0.300000011920928955078125), float3((eye * open) * dark));
    }
    fragColor = float4(col, fast::max(pic.w, dark));
}

fragment flair_transition_shadow_swallow_frag_out flair_transition_shadow_swallow_frag(constant FlairUniforms& _216 [[buffer(0)]], texture2d<float> uFrom [[texture(1)]], texture2d<float> uTo [[texture(2)]], sampler uFromSmplr [[sampler(1)]], sampler uToSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_transition_shadow_swallow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _711;
    if (_216.flair_flipY > 0.5)
    {
        _711 = _216.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _711 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _711);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _216, uFrom, uFromSmplr, uTo, uToSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

