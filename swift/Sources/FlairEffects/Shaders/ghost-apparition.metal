// flair-metal-hash: 5ce8e0df
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    uint uDouble;
    char _m14_pad[12];
    packed_float3 uGhost;
    float uX;
    float uSize;
    float uOpacity;
    float uGloom;
    float uCycle;
    uint uAnimate;
    float uProgress;
    char _m22_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_ghost_apparition_frag_out
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
float smin(thread const float& a, thread const float& b, thread const float& k)
{
    float h = fast::clamp(0.5 + ((0.5 * (b - a)) / k), 0.0, 1.0);
    return mix(b, a, h) - ((k * h) * (1.0 - h));
}

static inline __attribute__((always_inline))
float figure(thread const float2& q)
{
    float head = length(q - float2(0.0, 0.3300000131130218505859375)) - 0.0949999988079071044921875;
    float shoulders = (length((q - float2(0.0, 0.119999997317790985107421875)) / float2(0.17000000178813934326171875, 0.085000000894069671630859375)) - 1.0) * 0.085000000894069671630859375;
    float robe = fast::max(abs(q.x) - (0.1500000059604644775390625 + (0.119999997317790985107421875 * (0.119999997317790985107421875 - q.y))), q.y - 0.119999997317790985107421875);
    float param = head;
    float param_1 = shoulders;
    float param_2 = 0.0599999986588954925537109375;
    float param_3 = smin(param, param_1, param_2);
    float param_4 = robe;
    float param_5 = 0.039999999105930328369140625;
    return smin(param_3, param_4, param_5);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _227)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_227.uBackdrop) * _227.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_227.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    float4 _437;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _437 = overBackdrop(param, _227);
    }
    else
    {
        float2 param_1 = fract(uv);
        _437 = float4(testCard(param_1), 1.0);
    }
    return _437;
}

static inline __attribute__((always_inline))
float2 fitCoverUV(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    int2 ts = int2(tex.get_width(), tex.get_height());
    bool _366 = ts.x <= 1;
    bool _373;
    if (!_366)
    {
        _373 = ts.y <= 1;
    }
    else
    {
        _373 = _366;
    }
    bool _380;
    if (!_373)
    {
        _380 = _227.iResolution[0u] <= 0.0;
    }
    else
    {
        _380 = _373;
    }
    bool _387;
    if (!_380)
    {
        _387 = _227.iResolution[1u] <= 0.0;
    }
    else
    {
        _387 = _380;
    }
    if (_387)
    {
        return uv;
    }
    float boxAspect = _227.iResolution[0u] / _227.iResolution[1u];
    float texAspect = float(ts.x) / float(ts.y);
    float2 _410;
    if (boxAspect > texAspect)
    {
        _410 = float2(1.0, texAspect / boxAspect);
    }
    else
    {
        _410 = float2(boxAspect / texAspect, 1.0);
    }
    float2 scale = _410;
    return ((uv - float2(0.5)) * scale) + float2(0.5);
}

static inline __attribute__((always_inline))
float4 pictureCoverRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    float2 param = uv;
    float2 param_1 = fitCoverUV(tex, texSmplr, param, _227);
    return pictureRGBA(tex, texSmplr, param_1, _227);
}

static inline __attribute__((always_inline))
float3 pictureCover(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _227)
{
    float2 param = uv;
    return pictureCoverRGBA(tex, texSmplr, param, _227).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _227, texture2d<float> uImage, sampler uImageSmplr, texture2d<float> uFigure, sampler uFigureSmplr)
{
    float2 uv = fragCoord / float2(_227.iResolution[0], _227.iResolution[1]);
    float2 p = (fragCoord - (float2(_227.iResolution[0], _227.iResolution[1]) * 0.5)) / float2(_227.iResolution[1u]);
    float T = mod(_227.iTime, _227.uCycle) / _227.uCycle;
    float _571;
    if (_227.uAnimate != 0u)
    {
        _571 = smoothstep(0.0, 0.300000011920928955078125, T) * (1.0 - smoothstep(0.62000000476837158203125, 0.920000016689300537109375, T));
    }
    else
    {
        _571 = _227.uProgress;
    }
    float presence = _571;
    float _590;
    if (_227.uAnimate != 0u)
    {
        _590 = (4.0 * presence) * (1.0 - presence);
    }
    else
    {
        _590 = 0.0;
    }
    float unsteady = _590;
    float2 param = float2(floor(_227.iTime * 5.0), 2.0);
    presence *= (1.0 - ((0.300000011920928955078125 * unsteady) * step(0.60000002384185791015625, hash12(param))));
    float bob = 0.01200000010430812835693359375 * sin(_227.iTime * 1.2999999523162841796875);
    float2 q = (p - float2((_227.uX * _227.iResolution[0u]) / _227.iResolution[1u], bob - 0.0199999995529651641845703125)) / float2(_227.uSize);
    float lower = smoothstep(0.0, -0.5, q.y);
    float2 param_1 = float2(q.x * 6.0, (q.y * 3.0) - (_227.iTime * 0.4000000059604644775390625));
    int param_2 = 4;
    float _667 = fbm(param_1, param_2);
    float wisp = _667;
    q.x += (((wisp - 0.5) * 0.119999997317790985107421875) * lower);
    float2 param_3 = q;
    float d = figure(param_3);
    float fade = smoothstep(-0.519999980926513671875, -0.119999997317790985107421875, q.y + (0.25 * (wisp - 0.5)));
    float inside = (1.0 - smoothstep(-0.00999999977648258209228515625, 0.014999999664723873138427734375, d)) * fade;
    float rim = exp((-abs(d)) / 0.01200000010430812835693359375) * fade;
    float2 e = q - float2(0.0, 0.3350000083446502685546875);
    e.x = abs(e.x) - 0.037000000476837158203125;
    float eyes = (1.0 - smoothstep(0.01200000010430812835693359375, 0.02199999988079071044921875, length(e / float2(1.0, 1.39999997615814208984375)))) * step(abs(q.x), 0.100000001490116119384765625);
    float2 bend = ((float2(wisp - 0.5, 0.0) * 0.00999999977648258209228515625) * inside) * presence;
    float2 param_4 = uv + bend;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_4, _227);
    float grey = dot(pic.xyz, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 cold = (mix(float3(grey), pic.xyz, float3(0.449999988079071044921875)) * float3(0.819999992847442626953125, 0.920000016689300537109375, 1.0499999523162841796875)) * 0.699999988079071044921875;
    float3 col = mix(pic.xyz, cold, float3(_227.uGloom * (0.3499999940395355224609375 + (0.64999997615814208984375 * presence))));
    col *= (1.0 - (((0.5 * _227.uGloom) * presence) * smoothstep(0.300000011920928955078125, 0.89999997615814208984375, length(uv - float2(0.5)) * 1.39999997615814208984375)));
    float2 param_5 = (q * 4.0) + float2(0.0, (-_227.iTime) * 0.20000000298023223876953125);
    int param_6 = 3;
    float _819 = fbm(param_5, param_6);
    float3 fill = float3(_227.uGhost) * (0.550000011920928955078125 + (0.449999988079071044921875 * _819));
    if (_227.uDouble != 0u)
    {
        float2 fuv = float2((q.x / 0.60000002384185791015625) + 0.5, q.y + 0.5);
        float2 param_7 = fuv;
        fill = float3(_227.uGhost) * smoothstep(0.100000001490116119384765625, 0.89999997615814208984375, dot(pictureCover(uFigure, uFigureSmplr, param_7, _227), float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875)));
    }
    float a = _227.uOpacity * presence;
    col = mix(col, float3(1.0) - ((float3(1.0) - col) * (float3(1.0) - fill)), float3(inside * a));
    col += (((float3(_227.uGhost) * rim) * a) * 0.3499999940395355224609375);
    col = mix(col, col * 0.1500000059604644775390625, float3((eyes * inside) * a));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, inside * a));
}

fragment flair_ghost_apparition_frag_out flair_ghost_apparition_frag(constant FlairUniforms& _227 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uFigure [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uFigureSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_ghost_apparition_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _913;
    if (_227.flair_flipY > 0.5)
    {
        _913 = _227.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _913 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _913);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _227, uImage, uImageSmplr, uFigure, uFigureSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

