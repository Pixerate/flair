// flair-metal-hash: 427a37dc
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
    float3 uHot;
    packed_float3 uLamp;
    float uWeave;
    float uMelt;
    float uCycle;
    uint uAnimate;
    float uProgress;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_film_burn_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

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
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
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
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _236)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_236.uBackdrop) * _236.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_236.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _236)
{
    float4 _373;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _373 = overBackdrop(param, _236);
    }
    else
    {
        float2 param_1 = fract(uv);
        _373 = float4(testCard(param_1), 1.0);
    }
    return _373;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _236, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_236.iResolution[0], _236.iResolution[1]);
    float aspect = _236.iResolution[0u] / _236.iResolution[1u];
    float _411;
    if (_236.uAnimate != 0u)
    {
        _411 = _236.iTime;
    }
    else
    {
        _411 = _236.uProgress * _236.uCycle;
    }
    float T = _411;
    float cyc = floor(T / _236.uCycle);
    float u = fract(T / _236.uCycle);
    float _441;
    if (u < 0.3499999940395355224609375)
    {
        _441 = floor(T * 24.0);
    }
    else
    {
        _441 = floor(((cyc + 0.3499999940395355224609375) * _236.uCycle) * 24.0);
    }
    float frame = _441;
    float2 param = float2(frame * 0.300000011920928955078125, 1.0);
    float2 param_1 = float2(2.0, frame * 0.300000011920928955078125);
    float2 weave = ((float2(vnoise(param), vnoise(param_1)) - float2(0.5)) * 0.006000000052154064178466796875) * _236.uWeave;
    if ((u > 0.3499999940395355224609375) && (u < 0.5))
    {
        float2 param_2 = float2(floor(T * 8.0), 5.0);
        weave += ((hash22(param_2) - float2(0.5)) * 0.00999999977648258209228515625);
    }
    float2 param_3 = float2(cyc, 3.2999999523162841796875);
    float2 hot = (hash22(param_3) - float2(0.5)) * float2(0.5 * aspect, 0.5);
    float2 p = (fragCoord - (float2(_236.iResolution[0], _236.iResolution[1]) * 0.5)) / float2(_236.iResolution[1u]);
    float2 rel = p - hot;
    float dist = length(rel);
    float r = 1.39999997615814208984375 * powr(smoothstep(0.5, 0.87999999523162841796875, u), 1.60000002384185791015625);
    float2 param_4 = (rel * 6.0) + float2(cyc * 7.0);
    int param_5 = 4;
    float _548 = fbm(param_4, param_5);
    float edge = dist + (((_548 - 0.5) * 0.119999997317790985107421875) * (0.300000011920928955078125 + r));
    float near = exp((-fast::max(edge - r, 0.0)) / 0.07999999821186065673828125) * step(0.001000000047497451305389404296875, r);
    float2 st = (uv + weave) - ((((fast::normalize(rel + float2(9.9999997473787516355514526367188e-06)) * near) * 0.039999999105930328369140625) * _236.uMelt) / float2(aspect, 1.0));
    float2 param_6 = st;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_6, _236);
    float2 param_7 = float2(frame, 9.0);
    float3 col = pic.xyz * (0.939999997615814208984375 + (0.0599999986588954925537109375 * hash12(param_7)));
    float blisterZone = (smoothstep(0.4199999868869781494140625, 0.5, u) * (1.0 - smoothstep(0.0, 0.25 + r, dist))) * step(r, edge);
    float2 param_8 = (p * 45.0) + float2(T * 2.0);
    float bub = smoothstep(0.64999997615814208984375, 0.800000011920928955078125, vnoise(param_8));
    col = mix(col, (col * 1.2999999523162841796875) + (_236.uHot * 0.100000001490116119384765625), float3(bub * blisterZone));
    float charred = smoothstep(r + 0.0599999986588954925537109375, r + 0.00999999977648258209228515625, edge) * step(0.001000000047497451305389404296875, r);
    col = mix(col, float3(0.0500000007450580596923828125, 0.02999999932944774627685546875, 0.0199999995529651641845703125), float3(charred * 0.85000002384185791015625));
    float glow = exp((-abs(edge - r)) / 0.01200000010430812835693359375) * step(0.001000000047497451305389404296875, r);
    col = mix(col, _236.uHot, float3(fast::clamp(glow, 0.0, 1.0)));
    float hole = smoothstep(r, r - 0.00999999977648258209228515625, edge) * step(0.001000000047497451305389404296875, r);
    float2 param_9 = float2(floor(T * 24.0), 2.0);
    col = mix(col, float3(_236.uLamp) * (0.949999988079071044921875 + (0.0500000007450580596923828125 * hash12(param_9))), float3(hole));
    float next = smoothstep(0.89999997615814208984375, 1.0, u);
    col = mix(col, pic.xyz, float3(next));
    col *= (1.0 - (0.300000011920928955078125 * smoothstep(0.3499999940395355224609375, 0.89999997615814208984375, length(uv - float2(0.5)) * 1.2999999523162841796875)));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, (hole + glow) * (1.0 - next)));
}

fragment flair_film_burn_frag_out flair_film_burn_frag(constant FlairUniforms& _236 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_film_burn_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _757;
    if (_236.flair_flipY > 0.5)
    {
        _757 = _236.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _757 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _757);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _236, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

